import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GradientCard } from "@/components/ui/gradient-card"
import { FloatingLabelInput } from "@/components/ui/floating-label-input"
import { StatCard } from "@/components/ui/stat-card"
import { FeatureCard } from "@/components/ui/feature-card"
import { GlassCard } from "@/components/ui/glass-card"
import {
  Users,
  TrendingUp,
  Package,
  Zap,
  Shield,
  Palette
} from "lucide-react"

/**
 * Componente de demonstração dos componentes UI
 * Este componente mostra exemplos de uso de todos os componentes disponíveis
 */
export default function UIShowcase() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
            Componentes UI - DiPACK
          </h1>
          <p className="text-gray-600 text-lg">
            shadcn/ui + Origin UI - Componentes modernos e customizados
          </p>
        </div>

        {/* Buttons Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Buttons</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="gradient">Gradient DiPACK</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Badges Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Badges</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Floating Label Inputs */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Floating Label Inputs</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FloatingLabelInput label="Nome completo" type="text" />
                <FloatingLabelInput label="Email" type="email" />
                <FloatingLabelInput label="Telefone" type="tel" />
                <FloatingLabelInput label="CPF" type="text" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Stat Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Stat Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Usuários"
              value="1,234"
              description="Usuários ativos"
              icon={Users}
              trend={{ value: 12.5, isPositive: true }}
            />
            <StatCard
              title="Crescimento"
              value="45%"
              description="Este mês"
              icon={TrendingUp}
              trend={{ value: 8.2, isPositive: true }}
            />
            <StatCard
              title="Produtos"
              value="892"
              description="Em estoque"
              icon={Package}
              trend={{ value: 3.1, isPositive: false }}
            />
          </div>
        </section>

        {/* Gradient Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Gradient Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GradientCard variant="primary">
              <h3 className="text-xl font-bold mb-2">Primary Gradient</h3>
              <p className="text-white/90">
                Gradiente laranja/dourado do tema DiPACK
              </p>
            </GradientCard>
            <GradientCard variant="accent">
              <h3 className="text-xl font-bold mb-2">Accent Gradient</h3>
              <p className="text-white/90">
                Gradiente amarelo/laranja do tema DiPACK
              </p>
            </GradientCard>
            <GradientCard variant="subtle">
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Subtle Gradient
              </h3>
              <p className="text-gray-600">
                Gradiente sutil para backgrounds
              </p>
            </GradientCard>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Feature Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard
              icon={Zap}
              title="Rápido e Eficiente"
              description="Carregamento otimizado e performance excepcional para melhor experiência"
              variant="default"
              action={<Button variant="outline" size="sm">Saiba mais</Button>}
            />
            <FeatureCard
              icon={Shield}
              title="Seguro e Confiável"
              description="Proteção de dados de ponta a ponta com as melhores práticas"
              variant="highlighted"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white text-primary-600 hover:bg-gray-100"
                >
                  Ver detalhes
                </Button>
              }
            />
            <FeatureCard
              icon={Palette}
              title="Design Moderno"
              description="Interface bonita e intuitiva com componentes customizados"
              variant="default"
            />
            <FeatureCard
              icon={Package}
              title="Tudo Integrado"
              description="Todos os componentes funcionam perfeitamente juntos"
              variant="default"
            />
          </div>
        </section>

        {/* Glass Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Glass Cards</h2>
          <div className="bg-gradient-to-br from-primary-500 to-accent-500 p-8 rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GlassCard blur="sm">
                <h3 className="text-white text-lg font-bold mb-2">Blur SM</h3>
                <p className="text-white/90 text-sm">
                  Efeito glassmorphism com blur suave
                </p>
              </GlassCard>
              <GlassCard blur="md">
                <h3 className="text-white text-lg font-bold mb-2">Blur MD</h3>
                <p className="text-white/90 text-sm">
                  Efeito glassmorphism com blur médio
                </p>
              </GlassCard>
              <GlassCard blur="lg">
                <h3 className="text-white text-lg font-bold mb-2">Blur LG</h3>
                <p className="text-white/90 text-sm">
                  Efeito glassmorphism com blur forte
                </p>
              </GlassCard>
            </div>
          </div>
        </section>

        {/* Standard Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Standard Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Card com Header</CardTitle>
                <CardDescription>
                  Este é um card padrão do shadcn/ui
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Conteúdo do card. Você pode adicionar qualquer elemento aqui.
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary-200 hover:border-primary-400 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary-600" />
                  Card Customizado
                </CardTitle>
                <CardDescription>
                  Com classes personalizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Você pode facilmente customizar os cards com classes do Tailwind.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 text-gray-500">
          <p>Construído com shadcn/ui + Origin UI + Tailwind CSS</p>
          <p className="text-sm mt-2">
            Tema personalizado DiPACK (Laranja/Dourado)
          </p>
        </div>
      </div>
    </div>
  )
}
