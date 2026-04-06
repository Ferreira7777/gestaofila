package com.ferreira.gestaofila;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSmsPlugin.class);
        registerPlugin(NativeWhatsAppPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
