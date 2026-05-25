// Neo4j client — Graph Database for AI Recommendation Data
// To activate: uncomment the neo4j service in docker-compose.microservices.yml
// and set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in the ai-service environment.

let driver = null;

async function createDriver() {
  const uri = process.env.NEO4J_URI;
  if (!uri) {
    console.warn("⚠️  NEO4J_URI not set — graph recommendations disabled");
    return null;
  }

  try {
    const neo4j = require("neo4j-driver");
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(
        process.env.NEO4J_USER     || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      )
    );
    await driver.verifyConnectivity();
    console.log("✅ Neo4j verbunden (ai-service)");
    return driver;
  } catch (err) {
    console.warn("⚠️  Neo4j nicht erreichbar, Graph-Empfehlungen deaktiviert:", err.message);
    return null;
  }
}

function getDriver() {
  return driver;
}

// Helper: run a Cypher query and return records
async function runQuery(cypher, params = {}) {
  if (!driver) throw new Error("Neo4j not connected");
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

module.exports = { createDriver, getDriver, runQuery };
