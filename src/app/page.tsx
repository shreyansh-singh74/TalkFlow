"use client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session } = authClient.useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const onLogin = async () => {
    try {
      const result = await authClient.signIn.email({
        email,
        password
      });

      if (result.error) {
        if (
          result.error.message?.includes("Invalid credentials") ||
          result.error.message?.includes("not found") ||
          result.error.message?.includes("incorrect")
        ) {
          window.alert("Invalid email or password");
        } else {
          window.alert("Something went wrong: " + result.error.message);
        }
      } else {
        window.alert("Login successful");
      }
    } catch (error: any) {
      if (
        error?.message?.includes("already exists") ||
        error?.message?.includes("duplicate")
      ) {
        window.alert("User already exists");
      } else {
        window.alert("Something went wrong: " + String(error));
      }
    }
  };

  const onSubmit = async () => {
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        if (
          result.error.message?.includes("already exists") ||
          result.error.message?.includes("duplicate")
        ) {
          window.alert("User already exists");
        } else {
          window.alert("Something went wrong: " + result.error.message);
        }
      } else {
        window.alert("User created successfully");
      }
    } catch (error: any) {
      if (
        error?.message?.includes("already exists") ||
        error?.message?.includes("duplicate")
      ) {
        window.alert("User already exists");
      } else {
        window.alert("Something went wrong: " + String(error));
      }
    }
  };

  if (session) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          Welcome back, {session.user.name}
        </h2>
        <Button onClick={() => authClient.signOut()}>Sign Out</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-10">
      {/* Signup Logic */}
      <div className="p-4 flex flex-col gap-4">
        <Input
          placeholder="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button onClick={onSubmit}>Create User</Button>
      </div>

      {/* Login Logic */}
      <div className="p-4 flex flex-col gap-4">
        <Input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button onClick={onLogin}>Login</Button>
      </div>
    </div>
  );
}
