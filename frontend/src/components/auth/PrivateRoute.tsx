import {type FC, type ReactNode} from 'react';
import {Navigate, useLocation} from 'react-router-dom';
import {useAuthStore,isAuthReady} from '../../store/authStore';
import {LoadingScreen} from '../common/LoadingScreen';
interface PrivateRouteProps {children:ReactNode}
export const PrivateRoute:FC<PrivateRouteProps>=({children})=>{
 const auth=useAuthStore();const location=useLocation();
 if(['unknown','loading','resolving_identity'].includes(auth.authStatus)) return <div className="min-h-screen flex items-center justify-center"><LoadingScreen message="Verificando sua sessão…"/></div>;
 if(auth.authStatus==='error') return <div role="alert" className="p-6">Não foi possível verificar sua sessão. {auth.authProvider==='legacy'&&<button onClick={()=>void auth.checkAuth()}>Tentar novamente</button>}</div>;
 if(!isAuthReady(auth)) return <Navigate to="/" state={{from:location}} replace/>;
 return <>{children}</>;
};
export default PrivateRoute;
