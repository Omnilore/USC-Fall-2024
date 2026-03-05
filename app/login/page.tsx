"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AlertBox from "@/components/alertbox";
import { supabase, getRoles } from "@/app/supabase";
import Image from "next/image";
import OmniloreLogoImage from "@/components/assets/omnilore-logo.png";

export default function WrappedLoginPage() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  // Default general member credentials
  // Change line below to change the general user's username
  const GENERAL_MEMBER_LOGIN = "owlsrus";
  const GENERAL_MEMBER_PASSWORD = "love2learn";

  const DEFAULT_GENERAL_EMAIL = "member_db@omnilore.org";
  const DEFAULT_GENERAL_PASSWORD = "CBIWbvMQNUStFCGhnXwV";

  const searchParams = useSearchParams();
  const token = searchParams.get("token"); // Get token from URL

  useEffect(() => {
    if (token) {
      handleTokenLogin(token);
    }
  }, [token]);

  const handleTokenLogin = async (token: string) => {
    console.log("Token received:", token);
    // Extract the current UTC date (YYYY-MM-DD)
    const pre64_token = "somekey" + new Date().toISOString().split("T")[0];
    // Encode the token in Base64
    const calculated_token = Buffer.from(pre64_token).toString("base64");

    if (calculated_token !== token) return;

    // Proceed with authentication using Supabase
    try {
      await supabase.auth.signInWithPassword({
        email: "member_db@omnilore.org",
        password: DEFAULT_GENERAL_PASSWORD, // Using token as a password for authentication
      });

      // Redirect to the search page after successful login
      router.push("/members");
    } catch (error) {
      console.error("Authentication error:", error);
      alert("Authentication failed. Please try again.");
    }
  };

  const handleLogin = async () => {
    try {
      let userEmail = email;
      let userPassword = password;

      // Map "owlsrus" login to default general member email and password
      if (
        email.toLowerCase() === GENERAL_MEMBER_LOGIN
      ) {
        userEmail = DEFAULT_GENERAL_EMAIL;
      }

      // Authenticate user with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      });

      if (error) throw error;

      // Fetch user roles
      const roles = await getRoles();
      if (!roles || roles.length === 0) {
        throw new Error("Failed to retrieve roles");
      }

      console.log("Roles:", roles);

      // Redirect based on role
      if (
        roles.includes("dba") ||
        roles.includes("bioadmin") ||
        roles.includes("registrar") ||
        roles.includes("treasurer") ||
        roles.includes("membership")
      ) {
        router.push("/admin/tables");
      } else {
        router.push("/members");
      }
    } catch (error) {
      setAlertMessage(
        (error as Error).message || "Login failed. Please try again.",
      );
      setShowAlert(true);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      {showAlert && (
        <AlertBox message={alertMessage} onClose={() => setShowAlert(false)} />
      )}

      <div className="flex h-full w-full items-center justify-center bg-red-500">
        <div className="flex h-full w-[43%] flex-col justify-center gap-3 bg-white p-32">
          <div className="space-y-2 text-start">
            <h2 className="text-2xl font-semibold">Welcome back</h2>
          </div>
          <div className="text-[#666C7A]">
            Use your omnilore.org login information
          </div>

          <Input
            className="h-10 w-full rounded-lg border-none bg-[#EFF3F6] px-4"
            type="text"
            placeholder="Email or Username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            className="h-10 w-full rounded-lg border-none bg-[#EFF3F6] px-4"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            className="h-10 w-full rounded-lg bg-[#1E1F28] text-lg text-white"
            onClick={handleLogin}
          >
            Login
          </Button>
        </div>

        <div className="flex h-full w-[57%] items-center justify-center bg-gradient-to-b from-[#EDF2FD] to-[#FAF0EA]">
          <Image
            src={OmniloreLogoImage}
            alt="Omnilore - A community of curious minds"
            width={900}
            height={300}
            className="h-auto w-4/5 object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
