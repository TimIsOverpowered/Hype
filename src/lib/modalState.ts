let isModalOpen = false;

export function setModalOpen(open: boolean) {
  isModalOpen = open;
}

export function isModalCurrentlyOpen(): boolean {
  return isModalOpen;
}
