import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FileCheck, ArrowRight, Shield, Clock, Users, CheckCircle } from 'lucide-react';

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: FileCheck,
      title: 'Digital Clearance',
      description: 'Submit and track your clearance requests online',
    },
    {
      icon: Users,
      title: 'Multi-Signatory',
      description: 'Select required signatories from different departments',
    },
    {
      icon: Clock,
      title: 'Real-time Updates',
      description: 'Get instant notifications on approval status',
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Your documents are safely stored and protected',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center bg-gradient-hero overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-6 py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-primary-foreground">
            {/* Logo */}
            <div className="inline-flex items-center gap-3 mb-8 animate-fade-in">
              <div className="p-4 bg-primary-foreground/10 rounded-2xl backdrop-blur-sm">
                <FileCheck className="h-12 w-12" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 animate-slide-up">
              Saint Francis College - Guihulngan City
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Digital Clearance System
            </p>
            <p className="text-lg text-primary-foreground/70 max-w-2xl mx-auto mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              Streamlines your academic clearance process. Submit documents, select signatories, and track your clearance status — all in one place.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <Button
                variant="hero"
                size="xl"
                onClick={() => navigate('/auth')}
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                Get Started
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="xl"
                onClick={() => navigate('/auth')}
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-primary-foreground/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-primary-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A modern approach to academic clearance management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="p-6 rounded-2xl bg-card shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="p-3 bg-primary/10 rounded-xl w-fit mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-display font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-24 bg-muted">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Simple Steps to have your clearance signed
            </h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Register', desc: 'Create your account with student ID and course details' },
                { step: '02', title: 'Submit', desc: 'Upload documents and select required signatories' },
                { step: '03', title: 'Track', desc: 'Monitor approvals in real-time until completion' },
              ].map((item, index) => (
                <div key={index} className="text-center animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="text-5xl font-display font-bold text-gradient mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-display font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-primary">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto text-primary-foreground">
            <CheckCircle className="h-16 w-16 mx-auto mb-6 opacity-80" />
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Join SFC-G DCS today and experience hassle-free clearance processing.
            </p>
            <Button
              size="xl"
              onClick={() => navigate('/auth')}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              Create Your Account
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-sidebar text-sidebar-foreground">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-sidebar-primary" />
              <span className="font-display font-semibold">SFC-G DCS</span>
            </div>
            <p className="text-sm text-sidebar-foreground/60">
              © {new Date().getFullYear()} Digital Clearance System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
