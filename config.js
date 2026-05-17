const CONFIG = {
    // IMPORTANT: ເອົາ URL ຈາກ Google Apps Script Web App ມາໃສ່ນີ້
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyZ6lL_Xx-ogvH3jHlHiMNvLcQ0M2gaBinV5mFu6zjRXTuIj95vj5A7valiQpv3BHRV/exec',
    
    // ຕັ້ງຄ່າ GPS (ປ່ຽນຕາມສະຖານທີ່ຈິງ)
    ALLOWED_LOCATION: {
        lat: 17.9645,     // ສາມາດປ່ຽນເປັນພິກັດຂອງຫ້ອງການທ່ານ
        lng: 102.6139,    // ຕົວຢ່າງ: ນະຄອນຫຼວງວຽງຈັນ
        radius: 200       // ລັດສະໝີ 200 ແມັດ
    },
    
    // ລະຫັດຜ່ານ Admin (ປ່ຽນກ່ອນ Deploy ທຸກຄັ້ງ)
    ADMIN_PASSWORD: 'admin123'
};

// ຖ້າຕ້ອງການໃຊ້ງານແບບທົດສອບໂດຍບໍ່ຕ້ອງກວດ GPS (ໃຊ້ຕອນທົດສອບເທົ່ານັ້ນ)
// ໃຫ້ຕັ້ງ CONFIG.ALLOWED_LOCATION = null;