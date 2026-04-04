package com.ferreira.gestaofila;

import android.Manifest;
import android.content.pm.PackageManager;
import android.telephony.SmsManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.JSObject;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "NativeSms",
    permissions = {
        @Permission(strings = { Manifest.permission.SEND_SMS }, alias = "sms")
    }
)
public class NativeSmsPlugin extends Plugin {

    private static final int SMS_PERMISSION_CODE = 1001;

    @PluginMethod
    public void send(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message");

        if (phoneNumber == null || message == null) {
            call.reject("Número de telefone e mensagem são obrigatórios.");
            return;
        }

        // Verificar permissão
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            // Pedir permissão ao utilizador
            ActivityCompat.requestPermissions(
                getActivity(),
                new String[]{ Manifest.permission.SEND_SMS },
                SMS_PERMISSION_CODE
            );
            call.reject("Permissão de SMS não concedida. Tente novamente após aceitar.");
            return;
        }

        try {
            SmsManager smsManager = SmsManager.getDefault();

            // Dividir a mensagem se for muito longa (limite de 160 caracteres por SMS)
            ArrayList<String> parts = smsManager.divideMessage(message);

            if (parts.size() > 1) {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "SMS enviado com sucesso em background!");
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Falha ao enviar SMS: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                == PackageManager.PERMISSION_GRANTED;
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        ActivityCompat.requestPermissions(
            getActivity(),
            new String[]{ Manifest.permission.SEND_SMS },
            SMS_PERMISSION_CODE
        );
        JSObject result = new JSObject();
        result.put("requested", true);
        call.resolve(result);
    }
}
