import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle, ArrowLeft, ArrowRight, Check, Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccountType = 'individual' | 'company';

export const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading, error: authError, clearError } = useAuthStore();

  const [currentStep, setCurrentStep] = useState('account');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'individual' as AccountType,
    country: '',
    language: 'pt-BR',
    orgName: '',
    industry: '',
    companySize: '',
    termsAccepted: false
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep = (step: string) => {
    const errors: Record<string, string> = {};
    let isValid = true;

    if (step === 'account') {
      if (!formData.fullName) errors.fullName = 'Nome completo é obrigatório';
      if (!formData.email) errors.email = 'E-mail é obrigatório';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'E-mail inválido';

      if (!formData.password) errors.password = 'Senha é obrigatória';
      else if (formData.password.length < 6) errors.password = 'Mínimo de 6 caracteres';

      if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'As senhas não coincidem';
    }

    if (step === 'profile') {
      if (!formData.country) errors.country = 'País é obrigatório';
    }

    if (step === 'organization' && formData.accountType === 'company') {
      if (!formData.orgName) errors.orgName = 'Nome da organização é obrigatório';
      if (!formData.industry) errors.industry = 'Segmento é obrigatório';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      isValid = false;
    }

    return isValid;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === 'account') setCurrentStep('profile');
    else if (currentStep === 'profile') {
      if (formData.accountType === 'company') setCurrentStep('organization');
      else setCurrentStep('finish');
    }
    else if (currentStep === 'organization') setCurrentStep('finish');
  };

  const handleBack = () => {
    if (currentStep === 'profile') setCurrentStep('account');
    else if (currentStep === 'organization') setCurrentStep('profile');
    else if (currentStep === 'finish') {
      if (formData.accountType === 'company') setCurrentStep('organization');
      else setCurrentStep('profile');
    }
  };

  const handleSubmit = async () => {
    if (!formData.termsAccepted) {
      setFormErrors({ ...formErrors, terms: 'Você deve aceitar os termos' });
      return;
    }

    clearError();
    try {
      // Map form data to API expectations
      await register({
        username: formData.email, // Use email as username to match Login behavior
        email: formData.email,
        password: formData.password,
        role: 'admin', // Default to admin for new account creators
        // Add other profile fields if API supports structure
      });
      // Success handling is done in store/component wrapper usually, but here we redirect
      navigate('/login');
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const stepOrder = ['account', 'profile', 'organization', 'finish'];
  const currentStepIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-[1000px] h-[600px] bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl overflow-hidden flex">

        {/* Left Side - Form Area */}
        <div className="w-full lg:w-5/12 p-8 sm:p-10 flex flex-col relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <img
                src="/logo/logo.png"
                alt="Catana"
                className="w-8 h-8 object-contain dark:brightness-0 dark:invert"
              />
            </div>
            <div className="flex gap-1">
              {['account', 'profile', formData.accountType === 'company' ? 'organization' : null, 'finish']
                .filter(Boolean)
                .map((step, idx) => (
                  <div
                    key={step}
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-colors",
                      idx <= currentStepIndex ? "bg-zinc-900 dark:bg-white" : "bg-zinc-200 dark:bg-zinc-800"
                    )}
                  />
                ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">
              {currentStep === 'account' && 'Criar sua conta'}
              {currentStep === 'profile' && 'Perfil'}
              {currentStep === 'organization' && 'Sua Organização'}
              {currentStep === 'finish' && 'Confirmar dados'}
            </h1>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:bg-red-900/10 dark:border-red-900/20 dark:text-red-400">
                <AlertCircle className="w-3 h-3" />
                <span>{authError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {currentStep === 'account' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className={cn("h-10", formErrors.fullName && "border-red-500")}
                      placeholder="Ex: Ana Silva"
                    />
                    {formErrors.fullName && <span className="text-xs text-red-500">{formErrors.fullName}</span>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail Corporativo</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={cn("h-10", formErrors.email && "border-red-500")}
                      placeholder="nome@empresa.com"
                    />
                    {formErrors.email && <span className="text-xs text-red-500">{formErrors.email}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className={cn("h-10", formErrors.password && "border-red-500")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword">Confirmar</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className={cn("h-10", formErrors.confirmPassword && "border-red-500")}
                      />
                    </div>
                  </div>
                  {(formErrors.password || formErrors.confirmPassword) && (
                    <span className="text-xs text-red-500">{formErrors.password || formErrors.confirmPassword}</span>
                  )}
                </div>
              )}

              {currentStep === 'profile' && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label>Tipo de Conta</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => handleInputChange('accountType', 'individual')}
                        className={cn(
                          "p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 text-center",
                          formData.accountType === 'individual'
                            ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800"
                            : "border-zinc-100 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                        )}
                      >
                        <User className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        <span className="text-xs font-medium">Individual</span>
                      </div>
                      <div
                        onClick={() => handleInputChange('accountType', 'company')}
                        className={cn(
                          "p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 text-center",
                          formData.accountType === 'company'
                            ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800"
                            : "border-zinc-100 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                        )}
                      >
                        <Building2 className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        <span className="text-xs font-medium">Empresa</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>País / Região</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(val) => handleInputChange('country', val)}
                    >
                      <SelectTrigger className={cn("h-10", formErrors.country && "border-red-500")}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="br">Brasil</SelectItem>
                        <SelectItem value="us">Estados Unidos</SelectItem>
                        <SelectItem value="pt">Portugal</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.country && <span className="text-xs text-red-500">{formErrors.country}</span>}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Idioma</Label>
                    <Select
                      value={formData.language}
                      onValueChange={(val) => handleInputChange('language', val)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {currentStep === 'organization' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="orgName">Nome da Organização</Label>
                    <Input
                      id="orgName"
                      value={formData.orgName}
                      onChange={(e) => handleInputChange('orgName', e.target.value)}
                      className={cn("h-10", formErrors.orgName && "border-red-500")}
                      placeholder="Minha Empresa Ltda"
                    />
                    {formErrors.orgName && <span className="text-xs text-red-500">{formErrors.orgName}</span>}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Segmento</Label>
                    <Select
                      value={formData.industry}
                      onValueChange={(val) => handleInputChange('industry', val)}
                    >
                      <SelectTrigger className={cn("h-10", formErrors.industry && "border-red-500")}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">Varejo</SelectItem>
                        <SelectItem value="technology">Tecnologia</SelectItem>
                        <SelectItem value="manufacturing">Indústria</SelectItem>
                        <SelectItem value="services">Serviços</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.industry && <span className="text-xs text-red-500">{formErrors.industry}</span>}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tamanho da Empresa</Label>
                    <Select
                      value={formData.companySize}
                      onValueChange={(val) => handleInputChange('companySize', val)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Nº Colaboradores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10</SelectItem>
                        <SelectItem value="11-50">11-50</SelectItem>
                        <SelectItem value="51-200">51-200</SelectItem>
                        <SelectItem value="200+">200+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {currentStep === 'finish' && (
                <div className="space-y-6">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Nome</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-200">{formData.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">E-mail</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-200">{formData.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Conta</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-200">
                        {formData.accountType === 'company' ? 'Empresarial' : 'Individual'}
                      </span>
                    </div>
                    {formData.accountType === 'company' && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Empresa</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-200">{formData.orgName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={formData.termsAccepted}
                      onCheckedChange={(checked) => handleInputChange('termsAccepted', checked as boolean)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="terms"
                      className="text-xs text-zinc-500 leading-snug cursor-pointer"
                    >
                      Concordo com os <span className="text-zinc-900 underline dark:text-white">Termos de Uso</span> e <span className="text-zinc-900 underline dark:text-white">Política de Privacidade</span> do Catana.
                    </label>
                  </div>
                  {formErrors.terms && <span className="text-xs text-red-500 block -mt-4">{formErrors.terms}</span>}
                </div>
              )}
            </div>

            {/* Navigation Actions */}
            <div className="mt-8 flex items-center justify-between gap-4">
              {currentStep !== 'account' ? (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="rounded-xl border-zinc-200 hover:bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              ) : (
                <div /> /* Spacer */
              )}

              {currentStep === 'finish' ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="px-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      Criar Conta
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="px-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

            {currentStep === 'account' && (
              <p className="text-center text-xs text-zinc-500 mt-6">
                Já tem uma conta?{' '}
                <Link
                  to="/login"
                  className="text-zinc-900 hover:underline font-semibold dark:text-zinc-300 cursor-pointer"
                >
                  Entrar
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Right Side - Illustration Area (Matching Login footprint) */}
        <div className="hidden lg:block w-7/12 relative bg-zinc-50 dark:bg-zinc-900 overflow-hidden border-l border-zinc-100 dark:border-zinc-800">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950" />

          <div className="absolute inset-0 flex items-center justify-center">
            {/* Abstract geometric composition for 'Building'/'Structure' */}
            <div className="relative w-full h-full p-20">
              {/* Central structure */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80">
                <div className="absolute inset-0 border-[32px] border-zinc-100 dark:border-zinc-800 rounded-full animate-in fade-in zoom-in duration-1000 opacity-50" />
                <div className="absolute inset-8 border-[2px] border-dashed border-zinc-200 dark:border-zinc-700 rounded-full animate-[spin_60s_linear_infinite]" />

                {/* Floating elements */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-900 rounded-2xl shadow-xl -mt-12 -mr-12 animate-in slide-in-from-bottom duration-1000 delay-300 flex items-center justify-center">
                  <User className="text-white w-10 h-10 opacity-80" />
                </div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl shadow-xl -mb-10 -ml-10 animate-in slide-in-from-top duration-1000 delay-500 flex items-center justify-center">
                  <Building2 className="text-zinc-300 dark:text-zinc-600 w-12 h-12" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
