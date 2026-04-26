"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { OctagonAlert, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { useState } from "react";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
});

export const ForgotPasswordView = () => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setPending(true);
    setError(null);
    setSuccess(false);

    try {
      // First, check if user exists
      const checkResponse = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      const checkData = await checkResponse.json();

      if (!checkData.exists) {
        setError("User not found. Please check your email address.");
        setPending(false);
        return;
      }

      // If user exists, proceed with password reset
      await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: "/reset-password",
      });
      
      setSuccess(true);
      form.reset();
    } catch (err: unknown) {
      setError( err instanceof Error ? err.message : "Failed to send reset email. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">Forgot Password?</h1>
                  <p className="text-muted-foreground text-balance">
                    Enter your email and we&apos;ll send you a reset link
                  </p>
                </div>

                <div className="grid gap-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="ai@example.com"
                            {...field}
                            disabled={pending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {success && (
                  <Alert className="bg-green-500/10 border-green-500/50">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <AlertTitle>Check your email!</AlertTitle>
                    <AlertDescription>
                      We&apos;ve sent a password reset link to your email address.
                    </AlertDescription>
                  </Alert>
                )}

                {!!error && (
                  <Alert className="bg-destructive/10 border-none">
                    <OctagonAlert className="w-4 h-4 !text-destructive" />
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}

                <Button disabled={pending} type="submit" className="w-full">
                  {pending ? "Sending..." : "Send Reset Link"}
                </Button>

                <div className="text-center text-sm">
                  Remember your password?{" "}
                  <Link href={"/sign-in"} className="underline underline-offset-4">
                    Sign in
                  </Link>
                </div>
              </div>
            </form>
          </Form>

          <div className="bg-radial from-sidebar-accent to-sidebar p-10 relative hidden md:flex flex-col gap-y-4 items-center justify-center">
            <Image
              src="/logo.svg"
              alt="TalkFlow Logo"
              width={92}
              height={92}
              className="h-[92px] w-[92px]"
            />
            <p className="text-2xl font-semibold text-white">TalkFlow</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};