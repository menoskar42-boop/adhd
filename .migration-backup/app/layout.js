import "./globals.css";

export const metadata = {
  title: "NeuroPilot",
  description: "One-task focus app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
