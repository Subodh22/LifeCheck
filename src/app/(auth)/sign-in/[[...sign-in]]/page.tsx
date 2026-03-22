import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF]">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold mb-2">Life OS</h1>
          <p className="text-[#9B9A97] font-ui text-sm tracking-widest uppercase">
            Your personal life operating system
          </p>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorBackground: "#F7F7F5",
              colorText: "#191919",
              colorPrimary: "#2383E2",
              colorInputBackground: "#F0F0EE",
              colorInputText: "#191919",
              borderRadius: "4px",
              fontFamily: "Outfit, sans-serif",
            },
          }}
        />
      </div>
    </div>
  );
}
