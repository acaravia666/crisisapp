// API Handler totalmente independiente para evitar errores de importación en Vercel
export default async (req: any, res: any) => {
  try {
    const pkg = require('../package.json');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: "Ok",
      message: "API is alive and standalone",
      version: pkg.version,
      database: process.env.DATABASE_URL ? "Connected" : "Missing URL"
    }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Standalone fail", message: err.message }));
  }
};
