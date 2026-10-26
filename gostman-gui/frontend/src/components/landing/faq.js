export const FAQ = [
  {
    question: "Who is Gostman for?",
    answer: "Developers and testers who want their API collections kept as files next to the code: backend developers checking their own endpoints, frontend developers working against a mock before the API exists, QA engineers running API tests in CI, and teams that review request changes in pull requests. It also suits teams that cannot keep collections in a vendor's cloud, and people who want their coding agent to use the same requests. It is not the right tool if you need hosted collaboration, single sign-on or scheduled cloud monitors, because Gostman has no accounts.",
  },
  {
    question: "Is Gostman free?",
    answer: "Yes. Gostman is open source under the MIT licence. Every feature is in the download, with no account, no licence key and no seat count.",
  },
  {
    question: "Will Gostman add a paid tier?",
    answer: "Gostman has no paid tier, no account and no licence key, and every feature is in the free download. It is released under the MIT licence, so the published code stays free to use, change and fork whatever happens to the project.",
  },
  {
    question: "What happens to my collections if Gostman stops being developed?",
    answer: "They keep working. A folder workspace is plain YAML in your own repository, the desktop app and the command line need no Gostman server, and collections export to Postman, Bruno, OpenAPI, HAR and .http files. The MIT licence also lets anyone fork the code and carry it on.",
  },
  {
    question: "Where are my collections kept?",
    answer: "On your machine. The desktop app keeps them in its data folder or in a folder of YAML files you choose, and the web version keeps them in your browser's storage. Nothing is synced to a Gostman server.",
  },
  {
    question: "Does the web version send my requests through a server?",
    answer: "By default, yes. Browsers cannot call most APIs directly, so the web version relays each request through a small hosted proxy that stores neither the request nor the response and cannot reach localhost or private addresses. To reach those, run gostman relay on your computer and choose it in the web app's preferences, or use the desktop app, which sends requests from your own machine.",
  },
  {
    question: "Can I bring my Postman or Bruno collections?",
    answer: "Yes. Import Postman, Bruno (.bru files or the YAML format), Insomnia, OpenAPI, HAR, .http files and curl. Common pm.* and bru.* script calls are rewritten to Gostman's script API. An import only adds data, and it lists any scripts it carries before you accept them.",
    brands: ["postman", "bruno", "insomnia", "openapi"],
  },
  {
    question: "How does a team share a collection?",
    answer: "Open a folder and commit it with your code: one YAML file per request, reviewed in pull requests like any other change. For a quick hand-off, send an encrypted share link that is built in your window and never uploaded.",
  },
  {
    question: "Can it run in CI?",
    answer: "Yes. gostman run sends a folder with its scripts and assertions, prints what failed and exits non-zero, with text, JSON, JUnit and HTML reports. The repository includes a GitHub Action and a Dockerfile.",
    brands: ["github-actions", "docker"],
  },
]
