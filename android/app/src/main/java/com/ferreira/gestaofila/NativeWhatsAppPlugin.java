package com.ferreira.gestaofila;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "NativeWhatsApp")
public class NativeWhatsAppPlugin extends Plugin {

    @PluginMethod
    public void checkInstalledApps(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("whatsapp", isPackageInstalled("com.whatsapp", getContext()));
        ret.put("whatsappBusiness", isPackageInstalled("com.whatsapp.w4b", getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void shareWithAttachment(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message", "");
        String base64Image = call.getString("base64Image");
        String appPackage = call.getString("appPackage");

        if (appPackage == null || appPackage.isEmpty()) {
            call.reject("O pacote da aplicação ('appPackage') é obrigatório.");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setPackage(appPackage);

            if (base64Image != null && !base64Image.isEmpty()) {
                // Descodificar e guardar a imagem
                byte[] decodedBytes = Base64.decode(base64Image, Base64.DEFAULT);
                File cachePath = new File(getContext().getCacheDir(), "images");
                cachePath.mkdirs();
                File tempFile = new File(cachePath, "marketing_image.jpg");
                FileOutputStream fos = new FileOutputStream(tempFile);
                fos.write(decodedBytes);
                fos.flush();
                fos.close();

                // Obter URI seguro do FileProvider
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", tempFile);
                intent.putExtra(Intent.EXTRA_STREAM, uri);
                intent.setType("image/*");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                intent.setType("text/plain");
            }

            if (message != null && !message.isEmpty()) {
                intent.putExtra(Intent.EXTRA_TEXT, message);
            }

            if (phoneNumber != null && !phoneNumber.isEmpty()) {
                // Remover espaços e sinais
                String cleanPhone = phoneNumber.replaceAll("[^0-9]", "");
                if (cleanPhone.length() == 9) cleanPhone = "351" + cleanPhone; // Assumir PT
                intent.putExtra("jid", cleanPhone + "@s.whatsapp.net");
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Erro ao abrir WhatsApp: " + e.getMessage(), e);
        }
    }

    private boolean isPackageInstalled(String packageName, Context context) {
        try {
            context.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
