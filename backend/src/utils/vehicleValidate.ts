import { collectErrors, optPhone, optPlainText, optDate } from './validate';

export function parseVehicleTextFields(body: Record<string, unknown>) {
  const vVehicleNumber = optPlainText(body.vehicle_number, 'identifier', 80);
  const vChassis       = optPlainText(body.chassis_number, 'identifier', 80);
  const vVehicleType   = optPlainText(body.vehicle_type, 'note', 120);
  const vOwnerName     = optPlainText(body.owner_name, 'name', 200);
  const vOwnerPhone    = optPhone(body.owner_phone);
  const vDriverName    = optPlainText(body.driver_name, 'name', 200);
  const vDriverPhone   = optPhone(body.driver_phone);
  const vLocation      = optPlainText(body.location, 'location', 300);
  const vPdi           = optPlainText(body.pdi, 'note', 200);
  const vSpeakWith     = optPlainText(body.speak_with, 'name', 200);
  const vRemarks       = optPlainText(body.remarks, 'note', 2000);
  const vPurchaseDate  = optDate(body.purchase_date);

  const fieldErr = collectErrors({
    vehicle_number: vVehicleNumber.error,
    chassis_number: vChassis.error,
    vehicle_type: vVehicleType.error,
    owner_name: vOwnerName.error,
    owner_phone: vOwnerPhone.error,
    driver_name: vDriverName.error,
    driver_phone: vDriverPhone.error,
    location: vLocation.error,
    pdi: vPdi.error,
    speak_with: vSpeakWith.error,
    remarks: vRemarks.error,
    purchase_date: vPurchaseDate.error,
  });

  return {
    error: fieldErr,
    fields: {
      vehicle_number: vVehicleNumber.value,
      chassis_number: vChassis.value,
      vehicle_type: vVehicleType.value,
      owner_name: vOwnerName.value,
      owner_phone: vOwnerPhone.value,
      driver_name: vDriverName.value,
      driver_phone: vDriverPhone.value,
      location: vLocation.value,
      pdi: vPdi.value,
      speak_with: vSpeakWith.value,
      remarks: vRemarks.value,
      purchase_date: vPurchaseDate.value,
    },
  };
}
