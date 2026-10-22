export const FAQ = [
  {
    question: "Is Gostman free?",
    answer: "Yes. Gostman is open source under the MIT licence. Every feature is in the download, with no account, no licence key and no seat count.",
  },
  {
    question: "Where are my collections kept?",
    answer: "On your machine. The desktop app keeps them in its data folder or in a folder of YAML files you choose, and the web version keeps them in your browser's local storage. Nothing is synced to a Gostman server.",
  },
  {
    question: "Does the web version send my requests through a server?",
    answer: "Yes. Browsers cannot call any API directly, so the web version relays each request through a small proxy, which cannot reach localhost or private addresses. The desktop app sends requests from your own machine.",
  },
  {
    question: "Can I bring my Postman collections?",
    answer: "Yes. Import Postman, Insomnia, Bruno, OpenAPI, HAR and curl. An import only adds data, and it lists any scripts it carries before you accept them.",
  },
  {
    question: "How does a team share a collection?",
    answer: "Open a folder and commit it with your code: one YAML file per request, reviewed in pull requests like any other change. For a quick hand-off, send an encrypted share link that is built in your window and never uploaded.",
  },
  {
    question: "Can it run in CI?",
    answer: "Yes. gostman run sends a folder with its scripts and assertions, prints what failed and exits non-zero, with text, JSON, JUnit and HTML reports. The repository includes a GitHub Action and a Dockerfile.",
  },
]
