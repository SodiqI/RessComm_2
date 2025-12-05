import { Link } from 'react-router-dom';
import { Map, Layers, ArrowRight, Grid, BarChart3, Download, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-light via-background to-sage">
      {/* Hero Section */}
      <header className="zulim-header">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Map className="w-5 h-5 text-forest-light" />
            </div>
            <span className="text-lg font-bold">RessComm Plotter</span>
          </div>
          <nav>
            <Link to="/zulim">
              <Button variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-0">
                Open ZULIM
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-forest-light/10 rounded-full text-forest-dark text-sm font-medium mb-6">
            <Layers className="w-4 h-4" />
            Advanced Spatial Analysis
          </div>
          <h1 className="text-5xl font-bold text-forest-dark mb-6 leading-tight">
            ZULIM - Zonation of Land Use
            <span className="text-forest-light block">Intensification Management</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Powerful spatial interpolation and prediction tools for agricultural research, 
            environmental monitoring, and land management applications.
          </p>
          <Link to="/zulim">
            <Button size="lg" className="bg-forest-light hover:bg-forest-mid text-white px-8">
              Launch ZULIM
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          <FeatureCard 
            icon={<Map className="w-6 h-6" />}
            title="Spatial Interpolation"
            description="IDW, Kriging, Random Forest, and SVR algorithms for accurate surface prediction."
          />
          <FeatureCard 
            icon={<Grid className="w-6 h-6" />}
            title="Multi-layer Output"
            description="Generate continuous surfaces, classified maps, accuracy maps, and reliability extents."
          />
          <FeatureCard 
            icon={<BarChart3 className="w-6 h-6" />}
            title="Cross-Validation"
            description="Robust k-fold validation with RMSE, MAE, R², and bias metrics."
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6" />}
            title="Reliable Prediction Extent"
            description="Identify trustworthy prediction zones using convex hull, density, and uncertainty methods."
          />
          <FeatureCard 
            icon={<Layers className="w-6 h-6" />}
            title="Predictor Variables"
            description="Regression-based interpolation with feature importance analysis."
          />
          <FeatureCard 
            icon={<Download className="w-6 h-6" />}
            title="Comprehensive Export"
            description="Export to GeoTIFF, Shapefile, CSV, and PDF reports with reliability indicators."
          />
        </div>

        {/* Analysis Types */}
        <div className="bg-card rounded-2xl border border-border p-8 mb-20">
          <h2 className="text-2xl font-bold text-forest-dark mb-6 text-center">
            Two Powerful Analysis Modes
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 bg-sage-light rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mb-4">
                <Map className="w-5 h-5 text-info" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Single-Variable Interpolation</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Pure spatial interpolation for mapping a single target variable.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-info" />
                  Continuous interpolated raster
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-info" />
                  Classified map with custom classes
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-info" />
                  Spatial accuracy map (CV residuals)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-info" />
                  Reliable Prediction Extent (RPE)
                </li>
              </ul>
            </div>
            <div className="p-6 bg-sage-light rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-layer-uncertainty/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5 text-layer-uncertainty" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Predictor-Based Interpolation</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Regression-driven prediction with auxiliary environmental variables.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-layer-uncertainty" />
                  Model-based predicted surface
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-layer-uncertainty" />
                  Residual map (observed vs predicted)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-layer-uncertainty" />
                  Prediction uncertainty/confidence
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-layer-uncertainty" />
                  Feature importance rankings
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Ready to analyze your spatial data?</p>
          <Link to="/zulim">
            <Button size="lg" className="bg-forest-dark hover:bg-forest-mid text-white px-8">
              Get Started with ZULIM
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-20">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>RessComm Plotter - ZULIM Module</p>
          <p className="mt-1">Zonation of Land Use Intensification Management</p>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 hover:border-forest-light/50 hover:shadow-lg transition-all">
      <div className="w-12 h-12 rounded-lg bg-forest-light/10 flex items-center justify-center text-forest-light mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default Index;
