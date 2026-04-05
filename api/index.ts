export default async (req: any, res: any) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ 
    message: "Hello from CrisisApp API",
    env_check: process.env.DATABASE_URL ? "DB URL detected" : "DB URL MISSING",
    ready: true
  }));
};
