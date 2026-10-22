import { STEP_CHECK, STEP_RUN, STEP_SAVE, STEP_SEND, STEP_VARIABLE } from './onboarding'

export const ONBOARDING_TEXT = {
  title: 'Get started',
  progress: (done, total) => `${done} of ${total} done`,
  next: 'Next',
  completeTitle: 'You are set up',
  completeHint: 'You have tried the main parts of Gostman. The tutorial goes further with chaining requests, scripts and running your tests in CI.',
  tutorial: 'Read the tutorial',
  hide: 'Hide',
  hideLabel: 'Hide the getting started steps',
  done: 'Done',
  steps: {
    [STEP_SEND]: {
      title: 'Send a request',
      hint: 'Send a sample request to a public echo service and read the response.',
      action: 'Send sample request',
    },
    [STEP_SAVE]: {
      title: 'Save it to your collection',
      hint: 'Saved requests appear in the sidebar and stay on this device.',
      action: 'Save request',
    },
    [STEP_VARIABLE]: {
      title: 'Add a variable',
      hint: 'Define a value such as baseUrl once in an environment, then write {{baseUrl}} wherever it is needed.',
      action: 'Open environments',
    },
    [STEP_CHECK]: {
      title: 'Add a check',
      hint: 'Add an assertion such as res.status equals 200 and save the request. Each response then shows a pass or a fail.',
      action: 'Open the Tests tab',
    },
    [STEP_RUN]: {
      title: 'Run your requests together',
      hint: 'The runner sends every saved request in order and reports which checks passed.',
      action: 'Open the runner',
    },
  },
}
