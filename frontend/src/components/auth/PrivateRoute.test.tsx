import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import {PrivateRoute} from './PrivateRoute';
import {useAuthStore} from '../../store/authStore';
it.each([['loading',false],['ready',true]] as const)('gates protected content with %s lifecycle and never initializes auth',async(status,visible)=>{
 const checkAuth=vi.spyOn(useAuthStore.getState(),'checkAuth');
 useAuthStore.setState({isAuthenticated:true,authStatus:status});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try {
  await act(async()=>root.render(<MemoryRouter><PrivateRoute><div>Protected data</div></PrivateRoute></MemoryRouter>));
  expect(container.textContent?.includes('Protected data')).toBe(visible);expect(checkAuth).not.toHaveBeenCalled();
 } finally {await act(async()=>root.unmount());container.remove();checkAuth.mockRestore();}
});
