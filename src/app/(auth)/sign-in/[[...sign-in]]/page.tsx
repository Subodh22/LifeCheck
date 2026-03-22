import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF]">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold mb-2">Life OS</h1>
          <p className="text-[#64748B] font-ui text-sm tracking-widest uppercase">
            Your personal life operating system
          </p>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorBackground: "#FFFFFF",
              colorText: "#0F172A",
              colorPrimary: "#2563EB",
              colorInputBackground: "#F1F5F9",
              colorInputText: "#0F172A",
              borderRadius: "4px",
              fontFamily: "Outfit, sans-serif",
            },
          }}
        />
      </div>
    </div>
  );
}
