import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { FC } from 'react';
import { useProfiles } from '../context/ProfileContext';
import type { ProfileRecoveryNotice } from '../utils/profileMetadata';

export interface ProfileRecoveryBannerViewProps {
  notice: ProfileRecoveryNotice;
  onDismiss: () => void;
}

const headingFor = (kind: ProfileRecoveryNotice['kind']): string => ({
  repaired: 'Profile recovery completed',
  partial: 'Some profile data needs attention',
  read_only: 'Profiles are temporarily read-only',
  unsupported: 'A newer app version saved these profiles',
  remote_removal: 'Your active profile was removed in another tab',
}[kind]);

const explanationFor = (kind: ProfileRecoveryNotice['kind']): string => ({
  repaired: 'Your profile list was repaired safely.',
  partial: 'Valid profiles are available, but some saved runs were left untouched.',
  read_only: 'Recovered profiles are available, but profile-list changes cannot be saved right now.',
  unsupported: 'Profile management is read-only until this app supports the stored version.',
  remote_removal: 'The app switched to another available profile to keep this tab safe.',
}[kind]);

const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  count === 1 ? singular : pluralForm;

const recoveryDetails = (notice: ProfileRecoveryNotice): string[] => {
  if (notice.kind === 'remote_removal') return [];
  const details: string[] = [];
  if (notice.recoveredProfiles > 0) {
    details.push(`Recovered ${notice.recoveredProfiles} ${plural(notice.recoveredProfiles, 'profile')}.`);
  }
  if (notice.generatedNames > 0) {
    details.push(`Reconstructed ${notice.generatedNames} ${plural(notice.generatedNames, 'profile name')}.`);
  }
  if (notice.unreadableSaves > 0) {
    details.push(`Left ${notice.unreadableSaves} unreadable ${plural(notice.unreadableSaves, 'save')} untouched.`);
  }
  if (notice.overflowSaves > 0) {
    details.push(`Left ${notice.overflowSaves} additional ${plural(notice.overflowSaves, 'save')} untouched.`);
  }
  if (notice.rollbackFailures > 0) {
    details.push(`${notice.rollbackFailures} ${plural(notice.rollbackFailures, 'profile entry', 'profile entries')} could not be restored during rollback.`);
  }
  return details;
};

export const ProfileRecoveryBannerView: FC<ProfileRecoveryBannerViewProps> = ({
  notice,
  onDismiss,
}) => {
  const isStatus = notice.kind === 'repaired';
  const details = recoveryDetails(notice);

  const dismiss = () => {
    onDismiss();
    document.querySelector<HTMLElement>('[data-profile-switcher-trigger]')?.focus();
  };

  return (
    <div
      role={isStatus ? 'status' : 'alert'}
      aria-live={isStatus ? 'polite' : 'assertive'}
      className={`border-b shadow-lg ${
        isStatus
          ? 'border-emerald-400/30 bg-emerald-950/95 text-emerald-50'
          : 'border-amber-400/40 bg-amber-950/95 text-amber-50'
      }`}
    >
      <div className="mx-auto flex max-w-[1600px] items-start gap-3 px-4 py-3">
        {isStatus
          ? <CheckCircle2 className="mt-0.5 hidden shrink-0 text-emerald-300 sm:block" size={20} />
          : <AlertTriangle className="mt-0.5 hidden shrink-0 text-amber-300 sm:block" size={20} />}
        <div className="min-w-0 flex-1">
          <p className="font-bold">{headingFor(notice.kind)}</p>
          <p className={`text-sm ${isStatus ? 'text-emerald-100/80' : 'text-amber-100/80'}`}>
            {explanationFor(notice.kind)}
            {details.length > 0 && ` ${details.join(' ')}`}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss profile recovery notice"
          className="shrink-0 rounded p-1 text-current/70 transition-colors hover:bg-white/10 hover:text-current"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export const ProfileRecoveryBanner: FC = () => {
  const { recoveryNotice, dismissRecoveryNotice } = useProfiles();
  if (recoveryNotice === null) return null;
  return (
    <ProfileRecoveryBannerView
      notice={recoveryNotice}
      onDismiss={dismissRecoveryNotice}
    />
  );
};
