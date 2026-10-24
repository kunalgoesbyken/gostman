import { STEP_CHECK, STEP_RUN, STEP_SAVE, STEP_SEND, STEP_VARIABLE } from './onboarding'

export const ONBOARDING_TEXT = {
  title: 'Get started',
  progress: (done, total) => `${done} of ${total} done`,
  next: 'Next',
  completeTitle: 'You are set up',
  completeNotice: 'You finished getting started.',
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
      hint: 'Define baseUrl once in an environment, then write {{baseUrl}} wherever you need it.',
      action: 'Open environments',
      legend: [
        { name: '{{baseUrl}}', look: 'defined', label: 'defined' },
        { name: '{{token}}', look: 'missing', label: 'not defined yet' },
      ],
    },
    [STEP_CHECK]: {
      title: 'Add a check',
      hint: 'Write an assertion such as res.status equals 200, or use Add checks from this response in the Tests tab. Then save the request, and each response shows a pass or a fail.',
      action: 'Open the Tests tab',
    },
    [STEP_RUN]: {
      title: 'Run your requests together',
      hint: 'The runner sends every saved request in order and reports which checks passed.',
      action: 'Open the runner',
    },
  },
}
