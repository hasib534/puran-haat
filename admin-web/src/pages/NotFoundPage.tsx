import { Button, Icon } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-sm py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-outline">
        <Icon name="explore_off" className="text-[30px]" />
      </span>
      <h2 className="text-headline-md text-on-surface">This page does not exist</h2>
      <p className="max-w-[28rem] text-body-sm text-on-surface-variant">
        The admin portal only has the dashboard, user verification, user management, auctions,
        rewards and settings.
      </p>
      <Button variant="primary" icon="dashboard" className="mt-2" onClick={() => history.back()}>
        Go back
      </Button>
    </div>
  );
}
