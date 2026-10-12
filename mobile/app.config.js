module.exports = {
  expo: {
    name: "Sahyogi",
    slug: "sahyogi",
    version: "1.2.4",
    orientation: "portrait",
    icon: "./assets/images/newlogo.png",
    splash: {
      image: "./assets/images/newlogo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    scheme: "sahyogi",
    userInterfaceStyle: "automatic",
    ios: {
      icon: "./assets/images/newlogo.png"
    },
    android: {
      versionCode: 8,
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/newlogo.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false,
      package: "com.workfloww.sahyogi",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "API_KEY_MISSING_IN_ENV"
        }
      },
      permissions: [
        // "android.permission.ACCESS_COARSE_LOCATION",
        // "android.permission.ACCESS_FINE_LOCATION",
        // "android.permission.ACCESS_BACKGROUND_LOCATION",
        // "android.permission.FOREGROUND_SERVICE_LOCATION"
      ]
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FFFFFF",
          image: "./assets/images/newlogo.png",
          imageWidth: 200
        }
      ],
      "expo-video",
      "@react-native-community/datetimepicker",
      "expo-sharing",
      // [
      //   "expo-location",
      //   {
      //     locationAlwaysAndWhenInUsePermission: "Allow Sahyogi to use your location to track your route during active jobs.",
      //     locationAlwaysPermission: "Allow Sahyogi to track your location in the background so store managers can see your real-time ETA.",
      //     isIosBackgroundLocationEnabled: true,
      //     isAndroidBackgroundLocationEnabled: true
      //   }
      // ],
      "expo-secure-store"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "999659e5-5045-4ce6-aa34-5668376ae1a5"
      }
    },
    owner: "sahyogi"
  }
};
