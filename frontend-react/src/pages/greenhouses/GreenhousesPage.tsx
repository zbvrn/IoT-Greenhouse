import type { RouteState } from '../../types';
import GreenhouseDetailView from './GreenhouseDetailView';
import GreenhousesListView from './GreenhousesListView';
import { useGreenhousesPage } from './useGreenhousesPage';

type GreenhousesPageProps = {
  token: string;
  routeState: RouteState;
  onAuthExpired: () => void;
};

function GreenhousesPage({ token, routeState, onAuthExpired }: GreenhousesPageProps) {
  const {
    assignDevice,
    automation,
    createDevice,
    createGreenhouse,
    deleteGreenhouse,
    devices,
    greenhouses,
    isLoading,
    loadError,
    selectedGreenhouse,
    updateAutomation,
    updateGreenhouse,
  } = useGreenhousesPage({
    token,
    routeState,
    onAuthExpired,
  });

  if (isLoading) {
    return <p className="status-note">Загружаем теплицы и устройства...</p>;
  }

  if (loadError) {
    return <p className="form-error">{loadError}</p>;
  }

  if (routeState.route === 'greenhouse') {
    if (!selectedGreenhouse) {
      return <p className="form-error">Теплица не найдена.</p>;
    }

    return (
      <GreenhouseDetailView
        greenhouses={greenhouses}
        greenhouse={selectedGreenhouse}
        devices={devices}
        automation={automation}
        onCreateDevice={createDevice}
        onUpdateGreenhouse={updateGreenhouse}
        onDeleteGreenhouse={deleteGreenhouse}
        onUpdateAutomation={updateAutomation}
        onAssignDevice={assignDevice}
      />
    );
  }

  return (
    <GreenhousesListView
      greenhouses={greenhouses}
      devices={devices}
      onCreateGreenhouse={createGreenhouse}
      onCreateDevice={createDevice}
      onAssignDevice={assignDevice}
    />
  );
}

export default GreenhousesPage;
