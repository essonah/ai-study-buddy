/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(req, env) {
	    // Handle CORS preflight
	  if (req.method === "OPTIONS") {
		return new Response(null, {
		  headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST",
			"Access-Control-Allow-Headers": "Content-Type"
		  }
		});
	  }
	  if (req.method !== "POST") {
		return new Response("Send a POST request", { status: 405 });
	  }
  
	  const { message, userId = "default" } = await req.json();
  
	  // Save user message
	  await env.DB.prepare(
		"INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)"
	  ).bind(userId, "user", message).run();
  
	  // Get conversation history (last 20 messages = 10 exchanges)
	  const history = await env.DB.prepare(
		"SELECT role, content FROM messages WHERE user_id = ? ORDER BY id ASC LIMIT 20"
	  ).bind(userId).all();

	  const historyMessages = history.results.map((m: { role: string; content: string }) => ({
		role: m.role as "user" | "assistant" | "system",
		content: String(m.content ?? "")
	  }));

	  // Call Llama via Workers AI
	  const aiResponse = await env.AI.run(
		"@cf/meta/llama-3.2-3b-instruct",
		{
		  messages: [
			{
			  role: "system",
			  content: `You are an AI interview study buddy. Your rules:
- Always answer the user's exact question directly. If they ask to explain something (e.g. graphs), explain it. If they ask to solve a problem (e.g. two sum), solve it with clear explanation and code.
- Never say the user sent a "random character", "typo", or "brief interruption". Treat every message as intentional.
- Never say "let's get back on track" or deflect. Stay on the topic the user asked about.
- Be concise but thorough. Use code examples when explaining algorithms or data structures.`
			},
			...historyMessages
		  ]
		}
	  );

	  const reply = aiResponse.response ?? "";
  
	  // Save AI reply
	  await env.DB.prepare(
		"INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)"
	  ).bind(userId, "assistant", reply).run();
  
	  return Response.json({ reply }, {
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		  }
	  });
	}
  };