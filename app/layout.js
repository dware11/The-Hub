import './globals.css';
import Nav from '../components/Nav';

export const metadata = {
  title: 'C.O.D.E. Engineering Hub',
  description: 'Roy G. Perry College of Engineering — Prairie View A&M University',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        <Nav />
        <main className="max-w-6xl mx-auto px-6">{children}</main>
      </body>
    </html>
  );
}
