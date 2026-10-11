import Fastify from "fastify";
import jwt from "@fastify/jwt";
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
    await app.register(jwt, { secret: "test-jwt-secret" });
    await app.register(authRoutes, { prefix: "/auth" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns a JWT when the credentials are valid", async () => {
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
    });

    const body = response.json<{ user: User; token: string }>();
    expect(body.user.id).toBe(user.id);
    expect(app.jwt.verify<{ userId: number; role: string }>(body.token)).toMatchObject({
      userId: user.id,
      role: user.role,
    });
  });
});
