import { getFunctions, httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { firebaseApp, functionsRegion } from "./app.js";

export const functionsInstance = getFunctions(firebaseApp, functionsRegion);

export async function callFunction<TRequest, TResponse>(
  name: string,
  data: TRequest
): Promise<TResponse> {
  const callable = httpsCallable<TRequest, TResponse>(functionsInstance, name);
  const result: HttpsCallableResult<TResponse> = await callable(data);
  return result.data;
}
