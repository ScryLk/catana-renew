import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountSettingsModal } from '../components/studio/AccountSettingsModal';

export const Profile: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen bg-[#09090b] flex items-center justify-center relative overflow-hidden">
      <AccountSettingsModal
        isOpen={true}
        onClose={() => navigate('/')}
      />
    </div>
  );
};
