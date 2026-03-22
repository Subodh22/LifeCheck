import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B]">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="font-display text-5xl text-[#F2EEE8] italic mb-2">Life OS</h1>
          <p className="text-[#6B6760] font-ui text-sm tracking-widest uppercase">
            Your personal life operating system
          </p>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorBackground: "#111113",
              colorText: "#F2EEE8",
              colorPrimary: "#C9A84C",
              colorInputBackground: "#18181B",
              colorInputText: "#F2EEE8",
              borderRadius: "4px",
              fontFamily: "Outfit, sans-serif",
            },
          }}
        />
      </div>
    </div>
  );
}
