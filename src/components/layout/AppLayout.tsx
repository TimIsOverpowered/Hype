import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

export default function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <NavBar />
      <main className="flex flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
