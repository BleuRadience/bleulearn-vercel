// GET /api/hello -- platform health check. Public, no secrets exposed.
// Replaces the old Python version (api/hello.py) now that this runs on a
// plain Node.js host instead of Vercel's mixed-runtime serverless model --
// one consistent runtime (Node) is simpler to operate than two.
export default async function handler(req, res) {
  res.status(200).json({
    platform: 'BleuLearn Sovereign Curriculum',
    org: 'AvaBleu House HQ',
    year: 2026,
    strands: 25,
    runtime: 'Node.js + Express (platform-portable: Render, Railway, Coolify, or any Node host)',
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    aiGeneratorConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    status: 'operational'
  });
}
