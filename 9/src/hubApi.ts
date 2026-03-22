import { config } from "./config.js";

const BASE = config.AIDEVS_HUB_BASE_URL;
const KEY = config.AIDEVS_HUB_API_KEY;
const TASK = "mailbox";


export async function callZmail(params: Object): Promise<unknown> {
  const res = await fetch(`${BASE}/api/zmail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: KEY, ...(params as object) }),
  });
  const data: unknown = await res.json();

  console.log("ZMail reponse", JSON.stringify(data, null, 2));

  return data;
}

export async function submitAnswer({ systemPassword, attackDate, securityConfirmationPassword }: {
  systemPassword: string,
  attackDate: string,
  securityConfirmationPassword: string
}): Promise<unknown> {
  const res = await fetch(`${BASE}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: KEY, task: TASK, answer: { password: systemPassword, date: attackDate, confirmation_code: securityConfirmationPassword } }),
  });
  const data: unknown = await res.json();

  console.log("Centrala response:", JSON.stringify(data, null, 2));

  return data;
}
