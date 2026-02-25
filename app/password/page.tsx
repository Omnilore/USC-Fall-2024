"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AlertBox from "@/components/alertbox";
import { supabase, getRoles } from "@/app/supabase";
import Image from "next/image";
import LandingPageImage from "@/components/assets/landingpage.png";

export default function WrappedPasswordPage() {
  return (
    <Suspense>
      <PasswordPage />
    </Suspense>
  );
}

function PasswordPage() {
  const router = useRouter();
  // const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");


  const handlePassword = async () => {
    try {
      let userPassword = password;
      await supabase.auth.updateUser({ password: userPassword })
      router.push("/login");
    } catch (error) {
      setAlertMessage(
        (error as Error).message || "Password Reset failed. Please try again.",
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
            <h2 className="text-2xl font-semibold">Reset Password</h2>
          </div>
          <div className="text-[#666C7A]">
            Enter a new password
          </div>
          <Input
            className="h-10 w-full rounded-lg border-none bg-[#EFF3F6] px-4"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            className="h-10 w-full rounded-lg bg-[#1E1F28] text-lg text-white"
            onClick={handlePassword}
          >
            Reset Password
          </Button>
        </div>

        <div className="flex h-full w-[57%] items-end justify-end bg-linear-to-t from-[#FAF0EA] to-[#EDF2FD]">
          <Image
            src={LandingPageImage}
            alt="landing page image"
            layout="intrinsic"
            width={800}
            height={0}
            className="h-auto w-5/6"
          />
        </div>
      </div>
    </div>
  );
}
