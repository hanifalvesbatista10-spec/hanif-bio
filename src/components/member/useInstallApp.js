import { useEffect, useState } from "react";
import { canInstall, promptInstall, subscribeInstall } from "../../services/pwa";

// Diz se dá para instalar o app neste aparelho e oferece a ação de instalar.
export default function useInstallApp() {
  const [available, setAvailable] = useState(canInstall());

  useEffect(() => {
    const update = () => setAvailable(canInstall());
    update();
    return subscribeInstall(update);
  }, []);

  return { available, install: promptInstall };
}
