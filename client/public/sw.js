self.addEventListener('push', function (event) {
    console.log("📩 Événement Push reçu par le Service Worker !");
    
    let title = "CatCat";
    let options = {
        body: "Nouveau message !",
        icon: '/paw.png',
        badge: '/paw.png'
    };

    if (event.data) {
        try {
            const data = event.data.json();
            title = data.title || title;
            options.body = data.body || options.body;
        } catch (e) {
            console.warn("⚠️ Le payload n'est pas du JSON valide :", event.data.text());
        }
    }

    event.waitUntil(
        self.registration.showNotification(title, options).catch(err => {
            console.error("❌ Erreur critique lors de l'affichage de la notification :", err);
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow('/chat'));
});