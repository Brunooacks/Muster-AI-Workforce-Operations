// Driver cru, para quem precisa de uma conexão fora do DATABASE_URL (testes de
// migração em banco descartável). Importar daqui não exige DATABASE_URL.
export { default as pg } from "pg";
