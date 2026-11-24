import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { showAlert } from '../lib/alert';
import { cloudinaryConfigHint, isCloudinaryConfigured, uploadImagesToCloudinary } from '../lib/cloudinary';
import {
  isFirebaseConfigured,
  submitVerificationRequest,
  subscribeToMyVerifications,
  type FirestoreRecord,
} from '../lib/firebase';
import { Colors } from '../constants/colors';
import { BorderRadius, Spacing, Typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { AuthGate } from '../components/auth/AuthGate';
import type { VerificationRequest, VerificationStatusType } from '../types';

const MAX_PHOTOS = 2;

const DOCUMENT_TYPES = [
  { id: 'National ID (NID)', icon: 'badge' },
  { id: 'Passport', icon: 'flight' },
  { id: 'Driving licence', icon: 'directions_car' },
] as const;

function mapVerification(record: FirestoreRecord): VerificationRequest {
  return {
    id: record.id,
    user_id: String(record.user_id || ''),
    full_name: String(record.full_name || ''),
    document_type: String(record.document_type || ''),
    file_count: Number(record.file_count || 0),
    risk_score: Number(record.risk_score || 0),
    status: (record.status as VerificationStatusType) || 'pending',
    submitted_at: Number(record.submitted_at || 0),
    documents: Array.isArray(record.documents)
      ? (record.documents as unknown[]).filter((entry): entry is string => typeof entry === 'string')
      : [],
  };
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'just now';
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return 'recently';
  }
}

/**
 * Identity-review request screen.
 *
 * The trader files the request here; the decision is made in the admin portal
 * (`verifications` queue), which is also the only place that can write the
 * `is_verified` badge. This screen is deliberately read-only about the outcome:
 * it shows the latest request's status and never claims the account is
 * verified on its own.
 */
export default function VerificationScreen() {
  return (
    <AuthGate
      title="Sign in to get verified"
      description="Sign in to request the verified trader badge reviewed by the Puran Haat team."
    >
      <VerificationForm />
    </AuthGate>
  );
}

function VerificationForm() {
  const { user } = useAuth();
  const { profile, canUploadPhotos } = useApp();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(Boolean(user?.uid) && isFirebaseConfigured);
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0].id);
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured) return;
    return subscribeToMyVerifications(
      user.uid,
      (rows) => {
        setRequests(rows.map(mapVerification));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [user?.uid]);

  const latest = useMemo(
    () => [...requests].sort((a, b) => b.submitted_at - a.submitted_at)[0] ?? null,
    [requests],
  );

  const inReview = latest?.status === 'pending';
  const rejected = latest?.status === 'rejected';

  const remainingSlots = MAX_PHOTOS - photos.length;

  const pickPhoto = useCallback(
    async (fromCamera: boolean) => {
      if (remainingSlots <= 0) return;
      try {
        if (fromCamera) {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            showAlert('Camera permission needed', 'Allow camera access to photograph your document.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          });
          if (!result.canceled && result.assets?.[0]) {
            setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
          }
          return;
        }

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showAlert('Photo permission needed', 'Allow photo access to attach your document.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          selectionLimit: remainingSlots,
          quality: 0.7,
        });
        if (!result.canceled && result.assets?.length) {
          const picked = result.assets.map((asset) => asset.uri);
          setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
        }
      } catch {
        showAlert('Could not add photo', 'Something went wrong while picking an image.');
      }
    },
    [remainingSlots],
  );

  const choosePhoto = () => {
    showAlert('Add document photo', 'Photograph the page that shows your name and photo.', [
      { text: 'Camera', onPress: () => void pickPhoto(true) },
      { text: 'Photo Library', onPress: () => void pickPhoto(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (user.isAnonymous) {
      showAlert(
        'Create an account first',
        'Guest accounts cannot be verified. Create a free account, then request a review.',
        [{ text: 'Create account', onPress: () => router.push('/auth' as never) }],
      );
      return;
    }
    if (photos.length === 0) {
      showAlert('Add a document photo', 'Attach at least one clear photo of your identity document.');
      return;
    }
    if (!isCloudinaryConfigured() || !canUploadPhotos) {
      showAlert('Photo uploads not set up', cloudinaryConfigHint());
      return;
    }

    setSubmitting(true);
    try {
      const folder = `${process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || 'puran-haat'}/verifications`;
      const documents = await uploadImagesToCloudinary(photos, { folder });
      await submitVerificationRequest({
        uid: user.uid,
        full_name: profile.full_name,
        document_type: documentType,
        documents,
        // A self-reported heuristic only: the reviewer decides, and email
        // verification is one signal among several.
        risk_score: user.emailVerified ? 0.15 : 0.4,
      });
      setPhotos([]);
      showAlert(
        'Request submitted',
        'Our team will review your documents and update your badge. You can keep using Puran Haat while you wait.',
      );
    } catch (error) {
      showAlert('Could not submit request', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = !inReview && !loading;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verified Trader</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {profile.is_verified ? (
          <View style={[styles.statusCard, styles.statusApproved]}>
            <View style={styles.statusIcon}>
              <MaterialIcons name="verified" size={30} color={Colors.primary} />
            </View>
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>Verified trader</Text>
              <Text style={styles.statusText}>
                Your identity review was approved. The badge appears on your profile and on new
                listings.
              </Text>
            </View>
          </View>
        ) : inReview ? (
          <View style={[styles.statusCard, styles.statusPending]}>
            <View style={styles.statusIcon}>
              <MaterialIcons name="hourglass-top" size={28} color={Colors.tertiary} />
            </View>
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>Under review</Text>
              <Text style={styles.statusText}>
                Submitted {formatDate(latest?.submitted_at ?? 0)} with a{' '}
                {latest?.document_type.toLowerCase()}. Our team usually replies within two working
                days. We will update your badge automatically.
              </Text>
            </View>
          </View>
        ) : rejected ? (
          <View style={[styles.statusCard, styles.statusRejected]}>
            <View style={styles.statusIcon}>
              <MaterialIcons name="error-outline" size={28} color={Colors.error} />
            </View>
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>Request declined</Text>
              <Text style={styles.statusText}>
                The documents could not be confirmed. Check that the photo is clear, shows your
                full name, and has not expired, then submit again below.
              </Text>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Checking your requests…</Text>
          </View>
        ) : null}

        {!loading && !profile.is_verified ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Why get verified?</Text>
            {[
              'A badge on your profile and listings so neighbours know you are real.',
              'Trades with verified traders only, once the community opts in.',
              'Your documents are seen by the review team, never posted publicly.',
            ].map((line) => (
              <View key={line} style={styles.benefitRow}>
                <MaterialIcons name="check-circle" size={17} color={Colors.primary} />
                <Text style={styles.benefitText}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {showForm ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Document type</Text>
              <Text style={styles.cardSub}>
                Use a government-issued document that shows your name and photo.
              </Text>
              <View style={styles.typeGrid}>
                {DOCUMENT_TYPES.map((type) => {
                  const active = documentType === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      onPress={() => setDocumentType(type.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <MaterialIcons
                        name={type.icon as never}
                        size={20}
                        color={active ? Colors.onPrimary : Colors.primary}
                      />
                      <Text style={[styles.typeText, active && styles.typeTextActive]}>
                        {type.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Photos</Text>
                  <Text style={styles.cardSub}>
                    {photos.length}/{MAX_PHOTOS} attached. Front and back if the document has two
                    sides.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addPhoto}
                  onPress={choosePhoto}
                  disabled={remainingSlots <= 0}
                  accessibilityRole="button"
                  accessibilityLabel="Add document photo"
                >
                  <MaterialIcons
                    name="add-a-photo"
                    size={20}
                    color={remainingSlots <= 0 ? Colors.outline : Colors.primary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.photoRow}>
                {photos.map((uri) => (
                  <View key={uri} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.removePhoto}
                      onPress={() => setPhotos((prev) => prev.filter((entry) => entry !== uri))}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                    >
                      <MaterialIcons name="close" size={15} color={Colors.onPrimary} />
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS ? (
                  <TouchableOpacity
                    style={styles.photoPlaceholder}
                    onPress={choosePhoto}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <MaterialIcons name="photo-camera" size={24} color={Colors.outline} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {!canUploadPhotos ? (
                <Text style={styles.warning}>{cloudinaryConfigHint()}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.submit, submitting && styles.submitDisabled]}
              onPress={() => void handleSubmit()}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <>
                  <MaterialIcons name="verified-user" size={20} color={Colors.onPrimary} />
                  <Text style={styles.submitText}>
                    {rejected ? 'Submit new documents' : 'Request verification'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.privacy}>
              Documents are stored privately for the review team. Never send passwords, PINs or
              payment details.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21,66,18,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  scrollContent: {
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.sm,
    gap: 12,
  },

  statusCard: {
    flexDirection: 'row',
    gap: 12,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  statusApproved: {
    backgroundColor: 'rgba(21,66,18,0.06)',
    borderColor: 'rgba(21,66,18,0.16)',
  },
  statusPending: {
    backgroundColor: 'rgba(217,155,38,0.10)',
    borderColor: 'rgba(217,155,38,0.28)',
  },
  statusRejected: {
    backgroundColor: 'rgba(186,26,26,0.07)',
    borderColor: 'rgba(186,26,26,0.22)',
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBody: { flex: 1 },
  statusTitle: { ...Typography.labelLg, color: Colors.onSurface, fontWeight: '700' },
  statusText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 3,
    lineHeight: 19,
  },

  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { ...Typography.bodySm, color: Colors.onSurfaceVariant },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.06)',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  cardSub: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 3,
    marginBottom: Spacing.sm,
    lineHeight: 19,
  },

  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  benefitText: { ...Typography.bodySm, color: Colors.onSurface, flex: 1, lineHeight: 19 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.18)',
    backgroundColor: Colors.surfaceContainerLow,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { ...Typography.labelSm, color: Colors.primary, fontWeight: '600' },
  typeTextActive: { color: Colors.onPrimary },

  addPhoto: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(45,90,39,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  photoWrap: { width: 92, height: 92 },
  photo: {
    width: 92,
    height: 92,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(21,66,18,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  warning: {
    ...Typography.bodySm,
    color: Colors.tertiary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },

  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 15,
    marginTop: 2,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
  privacy: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
});