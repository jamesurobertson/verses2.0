import { MobileNavigation } from "../components/MobileNavigation/MobileNavigation"

interface LayoutProps {
  title: string;
  children: React.ReactNode;
}

const Layout = ({ title, children }: LayoutProps) => {
  return (
    <div className="flex flex-col bg-background" style={{
      height: '100dvh', // Dynamic viewport height for better mobile support
      maxHeight: '100dvh',
      overflow: 'hidden'
    }}>
      <header className="flex-shrink-0 bg-white px-4 py-4 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">{title}</h1>
        </div>
      </header>
      <main
        className="flex-1 px-4 overflow-x-hidden"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          minHeight: 0,
          // Calculate available height: full viewport - header height - nav height
          height: 'calc(100dvh - 4.25rem - 5rem)', // 4.25rem ≈ header, 5rem ≈ mobile nav
          paddingBottom: '7rem', // Extra padding so content isn't hidden behind nav
          overflowY: 'auto'
        }}
      >
        {children}
      </main>
      <MobileNavigation />
    </div>
  );
};

export default Layout
