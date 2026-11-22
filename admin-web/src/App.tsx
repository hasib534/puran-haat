import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { RequireAdmin } from './components/RequireAdmin';
import { AuctionsPage } from './pages/AuctionsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OverviewPage } from './pages/OverviewPage';
import { RewardConfigPage } from './pages/RewardConfigPage';
import { RewardsPage } from './pages/RewardsPage';
import { ScheduleAuctionPage } from './pages/ScheduleAuctionPage';
import { SettingsPage } from './pages/SettingsPage';
import { UserInvestigationPage } from './pages/UserInvestigationPage';
import { UsersPage } from './pages/UsersPage';
import { VerificationDetailPage } from './pages/VerificationDetailPage';
import { VerificationsPage } from './pages/VerificationsPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <RequireAdmin>
                <AppShell />
              </RequireAdmin>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="/verifications" element={<VerificationsPage />} />
            <Route path="/verifications/:id" element={<VerificationDetailPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:id" element={<UserInvestigationPage />} />
            <Route path="/auctions" element={<AuctionsPage />} />
            <Route path="/auctions/new" element={<ScheduleAuctionPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/rewards/configure" element={<RewardConfigPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
