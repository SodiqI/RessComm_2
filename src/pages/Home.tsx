import { Link } from 'react-router-dom';
import { Map, Layers, ArrowRight, FileSpreadsheet, MousePointer, Download, Users, Leaf, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const Home = () => {
  const [contactForm, setContactForm] = useState({ email: '', subject: '', message: '' });
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');
    
    try {
      const response = await fetch('https://formspree.io/f/xzzwyzed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      
      if (response.ok) {
        setFormStatus('success');
        setContactForm({ email: '', subject: '', message: '' });
        setTimeout(() => setFormStatus('idle'), 3000);
      } else {
        setFormStatus('error');
      }
    } catch {
      setFormStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-light via-background to-sage">
      {/* Header */}
      <header className="fixed w-full top-0 z-50 bg-gradient-to-r from-forest-dark to-forest-mid text-white shadow-lg">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-forest-light" />
            </div>
            <span className="text-lg font-bold text-forest-light">RessComm Plotter</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sage-light hover:text-white transition-colors">Features</a>
            <a href="#about" className="text-sage-light hover:text-white transition-colors">About</a>
            <a href="#team" className="text-sage-light hover:text-white transition-colors">Team</a>
            <a href="#contact" className="text-sage-light hover:text-white transition-colors">Contact</a>
            <Link to="/zulim">
              <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-0">
                ZULIM
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-dark/90 to-forest-mid/80" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-forest-light" />
          <div className="absolute bottom-20 right-32 w-24 h-24 rounded-full bg-sage-light" />
          <div className="absolute top-40 right-20 w-16 h-16 rounded-full bg-white" />
        </div>
        
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-sage-light mb-6">
            RessComm Plotter
          </h1>
          <p className="text-xl text-sage max-w-3xl mx-auto mb-8">
            Promoting Resilient Communities Through Accurate Land Management and Area Determination for Informed Decision Making
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/manual-plotter">
              <Button size="lg" className="bg-forest-light hover:bg-forest-mid text-white px-8">
                <MousePointer className="w-5 h-5 mr-2" />
                Manual Plotter
              </Button>
            </Link>
            <Link to="/excel-plotter">
              <Button size="lg" variant="outline" className="border-sage-light text-sage-light hover:bg-white/10 px-8">
                <FileSpreadsheet className="w-5 h-5 mr-2" />
                Excel Plotter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-b from-sage-light to-background">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-forest-dark text-center mb-12">Key Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<MousePointer className="w-8 h-8" />}
              title="Manual Polygon Plotting"
              description="Create precise land area polygons manually with coordinate input and real-time area calculations"
            />
            <FeatureCard 
              icon={<FileSpreadsheet className="w-8 h-8" />}
              title="Excel Data Integration"
              description="Upload Excel files and automatically plot multiple land areas with attribute data integration"
            />
            <FeatureCard 
              icon={<Download className="w-8 h-8" />}
              title="Export Capabilities"
              description="Export your plots as KMZ or Shapefile formats for professional GIS analysis and reporting"
            />
            <FeatureCard 
              icon={<Layers className="w-8 h-8" />}
              title="ZULIM Support"
              description="Supports Zonation of Land Use Intensification Management (ZULIM) for policy implementation"
            />
            <FeatureCard 
              icon={<Leaf className="w-8 h-8" />}
              title="Farm Management"
              description="Facilitates farm land intensification management for improved agricultural productivity"
            />
            <FeatureCard 
              icon={<Building className="w-8 h-8" />}
              title="Community Resilience"
              description="Contributes to building resilient communities through quality land management practices"
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gradient-to-br from-sage to-forest-light/20">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-forest-dark mb-6">About RessComm Plotter</h2>
              <p className="text-muted-foreground mb-4">
                RessComm Plotter is one of the brainchildren of RessComm, focused on promoting resilient communities. Land being a critical part of resilient communities requires adequate measurement and area determination for informed decision making.
              </p>
              <p className="text-muted-foreground mb-4">
                Policies that promote Zonation of Land Use Intensification Management (ZULIM), farm land intensification management, and livelihood management are all dependent on quality land management.
              </p>
              <p className="text-sm text-forest-mid font-medium">
                <strong>Important Note:</strong> The accuracy of plots created with this application is based on the accuracy of the coordinates being used for plotting. Please ensure coordinate data quality for reliable results.
              </p>
            </div>
            <div className="bg-gradient-to-br from-forest-light to-forest-mid rounded-2xl h-72 flex flex-col items-center justify-center text-white">
              <Map className="w-16 h-16 mb-4 opacity-80" />
              <p className="text-lg font-semibold">Land Measurement Visualization</p>
              <p className="text-sm opacity-80">Precision mapping for resilient communities</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-20 bg-gradient-to-b from-background to-sage-light">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-forest-dark text-center mb-4">Expert Contributors</h2>
          <p className="text-muted-foreground text-center mb-12">
            Experts contributing to resilience cut across different fields
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <TeamMember name="S. O. Ibrahim" role="Natural Resource Management Specialist" />
            <TeamMember name="U. S. Anka" role="Director Climate Change" />
            <TeamMember name="S. Ngwu" role="Agricultural Livelihood Expert" />
            <TeamMember name="U. Oragbe" role="Library and Information Science" />
            <TeamMember name="T. Oladele" role="Computational Mathematics" />
            <TeamMember name="E. Oladele" role="Agricultural Production" />
            <TeamMember name="M. A Yunusa" role="Flood Risk Management" />
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gradient-to-b from-sage-light to-background">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-forest-dark text-center mb-4">Contact Us</h2>
          <p className="text-muted-foreground text-center mb-8">
            Leave your message and we'll get back to you at afrimics@gmail.com
          </p>
          <form onSubmit={handleContactSubmit} className="max-w-xl mx-auto space-y-4">
            <div>
              <label className="block text-sm font-medium text-forest-dark mb-1">Your Email</label>
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                required
                className="w-full px-4 py-3 rounded-lg border border-sage focus:border-forest-light focus:ring-2 focus:ring-forest-light/20 bg-sage-light"
                placeholder="Enter your email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest-dark mb-1">Message Title</label>
              <input
                type="text"
                value={contactForm.subject}
                onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                required
                className="w-full px-4 py-3 rounded-lg border border-sage focus:border-forest-light focus:ring-2 focus:ring-forest-light/20 bg-sage-light"
                placeholder="Brief title for your message"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest-dark mb-1">Your Message</label>
              <textarea
                value={contactForm.message}
                onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                required
                rows={5}
                className="w-full px-4 py-3 rounded-lg border border-sage focus:border-forest-light focus:ring-2 focus:ring-forest-light/20 bg-sage-light resize-none"
                placeholder="Type your message here..."
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-forest-light hover:bg-forest-mid"
              disabled={formStatus === 'sending'}
            >
              {formStatus === 'sending' ? 'Sending...' : 'Submit Message'}
            </Button>
            {formStatus === 'success' && (
              <p className="text-center text-forest-light font-medium">Message sent successfully!</p>
            )}
            {formStatus === 'error' && (
              <p className="text-center text-destructive font-medium">Error sending message. Please try again.</p>
            )}
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-forest-dark to-forest-mid text-white py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-bold text-forest-light mb-4">RessComm</h3>
              <p className="text-sage-light text-sm">
                Building resilient communities through innovative land management solutions.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-forest-light mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/manual-plotter" className="text-sage-light hover:text-white">Manual Plotter</Link></li>
                <li><Link to="/excel-plotter" className="text-sage-light hover:text-white">Excel Plotter</Link></li>
                <li><Link to="/zulim" className="text-sage-light hover:text-white">ZULIM</Link></li>
                <li><a href="#about" className="text-sage-light hover:text-white">About</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-forest-light mb-4">Contact Info</h3>
              <p className="text-sage-light text-sm">Email: afrimics@gmail.com</p>
              <p className="text-sage-light text-sm mt-2">Building sustainable futures through technology</p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-sage-light text-sm">
            <p>&copy; 2024 RessComm. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 hover:border-forest-light/50 hover:shadow-lg transition-all">
      <div className="w-14 h-14 rounded-lg bg-forest-light/10 flex items-center justify-center text-forest-light mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-lg text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function TeamMember({ name, role }: { name: string; role: string }) {
  return (
    <div className="bg-card rounded-xl border-l-4 border-forest-light p-5 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-full bg-forest-light/20 flex items-center justify-center mb-3">
        <Users className="w-5 h-5 text-forest-light" />
      </div>
      <h4 className="font-semibold text-forest-dark">{name}</h4>
      <p className="text-sm text-muted-foreground">{role}</p>
    </div>
  );
}

export default Home;
