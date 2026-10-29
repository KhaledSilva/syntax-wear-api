import Fastify from "fastify";
import jwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import authRoutes from "../src/routes/auth.routes";
import { loginUser } from "../src/services/auth.service";

vi.mock("../src/services/auth.service", () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
}));

describe("POST /auth/login", () => {
  const app = Fastify({ logger: false });

  beforeEach(async () => {
    vi.clearAllMocks();
    await app.register(fastifyCookie);
    await app.register(jwt, { secret: "test-jwt-secret" });
    await app.register(authRoutes, { prefix: "/auth" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("Retorna o usuário e define um cookie JWT quando as credenciais são válidas", async () => {
    const user: User = {
      id: 42,
      firstName: "Teste",
      lastName: "Usuario",
      email: "teste@example.com",
      password: "hashed-password",
      cpf: null,
      phone: null,
      birthDate: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      role: "USER",
    };

    vi.mocked(loginUser).mockResolvedValue(user);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: user.email,
        password: "senha-valida",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(loginUser).toHaveBeenCalledWith({
      email: user.email,
      password: "senha-valida",
    }, expect.anything());

    const body = response.json<{ user: User }>();
    expect(body.user.id).toBe(user.id);
    const setCookieHeader = response.headers["set-cookie"];
    const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
    const tokenMatch = cookie?.match(/syntaxwear\.token=([^;]+)/);

    expect(tokenMatch).not.toBeNull();
    if (!tokenMatch) {
      throw new Error("O cookie syntaxwear.token não foi retornado");
    }

    expect(app.jwt.verify<{ userId: number; role: string }>(tokenMatch[1])).toMatchObject({
      userId: user.id,
      role: user.role,
    });
  });
});
