-- Gli orari d'esempio dei dati demo non devono comparire sul sito: li inserisce il titolare da Impostazioni.
UPDATE settings SET value = '' WHERE key = 'hours' AND value = 'Lun–Sab 8:30–13:00 / 15:00–19:00';
UPDATE settings SET value = '' WHERE key = 'city' AND value = 'La tua città';
UPDATE locations SET hours = NULL WHERE hours = 'Lun–Sab 8:30–13:00 / 15:00–19:00';
