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
	  if (req.method !== "POST") {
		return new Response("Send a POST request", { status: 405 });
	  }
  
	  const { message, userId = "default" } = await req.json();
  
	  // Save user message
	  await env.DB.prepare(
		"INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)"
	  ).bind(userId, "user", message).run();
  
	  // Get conversation history
	  const history = await env.DB.prepare(
		"SELECT role, content FROM messages WHERE user_id = ? ORDER BY id ASC LIMIT 10"
	  ).bind(userId).all();
  
	  // Call Llama 3.3 via Workers AI
	  const aiResponse = await env.AI.run(
		"@cf/meta/llama-3.1-8b-instruct",
		{
		  messages: history.results.map(m => ({
			role: m.role,
			content: m.content
		  }))
		}
	  );
  
	  const reply = aiResponse.response;
  
	  // Save AI reply
	  await env.DB.prepare(
		"INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)"
	  ).bind(userId, "assistant", reply).run();
  
	  return Response.json({ reply });
	}
  };