export const f2Credential = {
  publicKey: "pk-lf-f2-public",
  secretKey: "sk-lf-f2-secret",
  baseUrl: "https://cloud.langfuse.com",
};

export const f2ProjectsResponse = {
  data: [{ id: "project-f2", name: "Projeto F2" }],
};

export const f2ObservationPages = [
  {
    data: [
      {
        id: "obs-f2-1",
        traceId: "trace-f2-1",
        traceName: "Agente de suporte",
        input: { prompt: "não deve sair" },
      },
    ],
    meta: { cursor: "f2-observations-page-2" },
  },
  {
    data: [
      {
        id: "obs-f2-2",
        traceId: "trace-f2-2",
        traceName: "Agente financeiro",
      },
    ],
    meta: { cursor: "f2-observations-page-3" },
  },
  {
    data: [{ id: "obs-f2-3", traceId: "trace-f2-3", traceName: "Agente RH" }],
    meta: {},
  },
];

export const f2ScorePages = [
  {
    data: [
      {
        id: "score-f2-1",
        subject: { kind: "trace", id: "trace-f2-1" },
      },
    ],
    meta: { limit: 1000 },
  },
];
