/**
 * Step logic for the intro wizard (components/OnboardingWizard.tsx).
 *
 * 'finish' means "leave the intro": the wizard calls completeOnboarding, and
 * App then opens the game mode picker for the still-empty run. Skip uses the
 * same exit as the last Next, so skipping the intro never skips the mode
 * choice. Back and Escape only ever step back; neither can close the intro.
 */
export type OnboardingAction = 'next' | 'back' | 'skip' | 'escape';

export const onboardingStepAfter = (
  step: number,
  total: number,
  action: OnboardingAction,
): number | 'finish' => {
  const last = Math.max(0, total - 1);
  const current = Math.min(Math.max(0, step), last);
  switch (action) {
    case 'next':
      return current < last ? current + 1 : 'finish';
    case 'skip':
      return 'finish';
    case 'back':
    case 'escape':
      return Math.max(0, current - 1);
  }
};

/** Back shows from the second step on. */
export const onboardingCanGoBack = (step: number): boolean => step > 0;

/** Skip hides on the last step, where Start already leaves the intro. */
export const onboardingCanSkip = (step: number, total: number): boolean => step < total - 1;
