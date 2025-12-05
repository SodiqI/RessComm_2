import { Link } from 'react-router-dom';
import { Map, Home, Grid, FileSpreadsheet, Layers } from 'lucide-react';

export function ZulimHeader() {
  return (
    <header className="zulim-header px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          <Map className="w-5 h-5 text-forest-light" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">ZULIM</h1>
          <p className="text-xs text-white/70">Zonation of Land Use Intensification Management</p>
        </div>
      </div>
      
      <nav>
        <ul className="flex items-center gap-1">
          <li>
            <Link 
              to="/" 
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </li>
          <li>
            <Link 
              to="/zulim" 
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-forest-light bg-white/10 font-medium"
            >
              <Layers className="w-4 h-4" />
              ZULIM
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
