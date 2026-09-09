
const products = [
    // Açougue & Frios
    { code: 'FR-02', name: 'Embalagem Frios 2', category: 'Açougue & Frios', shape: 'Rectangular PET Container' },
    { code: 'FR-03', name: 'Embalagem Frios 3', category: 'Açougue & Frios', shape: 'Rectangular PET Container' },
    { code: 'FR-04', name: 'Embalagem Frios 4', category: 'Açougue & Frios', shape: 'Rectangular PET Container' },
    { code: 'FF-02', name: 'Embalagem Frios Fatiados 2', category: 'Açougue & Frios', shape: 'Low Profile Rectangular PET Container' },
    { code: 'FF-03', name: 'Embalagem Frios Fatiados 3', category: 'Açougue & Frios', shape: 'Low Profile Rectangular PET Container' },
    { code: 'FF-04', name: 'Embalagem Frios Fatiados 4', category: 'Açougue & Frios', shape: 'Low Profile Rectangular PET Container' },
    { code: 'A-02', name: 'Embalagem Açougue 2', category: 'Açougue & Frios', shape: 'Deep Rectangular PET Container' },
    { code: 'A-03', name: 'Embalagem Açougue 3', category: 'Açougue & Frios', shape: 'Deep Rectangular PET Container' },
    { code: 'A-04', name: 'Embalagem Açougue 4', category: 'Açougue & Frios', shape: 'Deep Rectangular PET Container' },

    // Confeitaria (Potes & Tortas)
    // Converting "Embalagem PET" to specific shapes based on usage
    { code: 'PF-08', name: 'Embalagem PET para doces', category: 'Confeitaria', shape: 'Small Rectangular Hinged PET Container' },
    { code: 'PF-10', name: 'Embalagem PET para doces médios', category: 'Confeitaria', shape: 'Medium Rectangular Hinged PET Container' },
    { code: 'PF-13', name: 'Embalagem PET para tortinhas', category: 'Confeitaria', shape: 'Round Hinged PET Container' },
    { code: 'PF-18', name: 'Embalagem PET para mini tortas', category: 'Confeitaria', shape: 'Round Hinged PET Container' },
    { code: 'PF-20', name: 'Embalagem PET para tortas pequenas', category: 'Confeitaria', shape: 'Round Cake PET Container' },
    { code: 'PF-22', name: 'Embalagem PET para tortas médias', category: 'Confeitaria', shape: 'Round Cake PET Container' },
    { code: 'PF-25', name: 'Embalagem PET para tortas médias altas', category: 'Confeitaria', shape: 'High Dome Round Cake PET Container' },
    { code: 'PF-32A', name: 'Embalagem PET para tortas grandes', category: 'Confeitaria', shape: 'Large Round Cake PET Container' },
    { code: 'PF-32B', name: 'Embalagem PET para tortas grandes B', category: 'Confeitaria', shape: 'Large Round Cake PET Container' },
    { code: 'PF-50', name: 'Embalagem PET para tortas extragrandes', category: 'Confeitaria', shape: 'Extra Large Round Cake PET Container' },
    { code: 'PF-60', name: 'Embalagem PET para tortas premium', category: 'Confeitaria', shape: 'Premium Round Cake PET Container' },
    { code: 'PF-70', name: 'Embalagem PET para tortas especiais', category: 'Confeitaria', shape: 'Special Tall Round Cake PET Container' },
    { code: 'PF-80', name: 'Embalagem PET para tortas família', category: 'Confeitaria', shape: 'Family Size Round Cake PET Container' },

    { code: 'POTE-250', name: 'Pote PET 250 ml', category: 'Confeitaria', shape: 'Round PET Pot with Lid' },
    { code: 'POTE-300', name: 'Pote PET 300 ml', category: 'Confeitaria', shape: 'Round PET Pot with Lid' },
    { code: 'POTE-350', name: 'Pote PET 350 ml', category: 'Confeitaria', shape: 'Round PET Pot with Lid' },
    { code: 'POTE-500', name: 'Pote PET 500 ml', category: 'Confeitaria', shape: 'Round PET Pot with Lid' },
    { code: 'POTE-750', name: 'Pote PET 750 ml', category: 'Confeitaria', shape: 'Round PET Pot with Lid' },

    // Festa
    { code: 'LF-01', name: 'Caixa Quadrada Premium PET', category: 'Festa', shape: 'Square Premium PET Box' },
    { code: 'LF-02', name: 'Caixa para Brigadeiros', category: 'Festa', shape: 'Rectangular 6-cavity PET Box' },
    { code: 'LF-03', name: 'Cúpula para Mini Bolo', category: 'Festa', shape: 'Mini Dome Cake Container' },
    { code: 'LF-04', name: 'Embalagem para Fatia de Bolo', category: 'Festa', shape: 'Triangular Cake Slice Container' },
    { code: 'LF-05', name: 'Embalagem para Torta/Salgados', category: 'Festa', shape: 'Square Hinged Container' },
    { code: 'LF-06', name: 'Marmita/Caixa Take Away', category: 'Festa', shape: 'Rectangular Takeaway Container' },
    { code: 'LF-07', name: 'Pote Diamante P', category: 'Festa', shape: 'Diamond Faceted Small Pot' },
    { code: 'LF-08', name: 'Pote Diamante G', category: 'Festa', shape: 'Diamond Faceted Large Pot' },
    { code: 'LF-09', name: 'Pote Redondo com Tampa', category: 'Festa', shape: 'Round Pot with Flat Lid' },

    // Food Service
    { code: 'FS-01', name: 'Pote Térmico HF-01', category: 'Food Service', shape: 'Thermal EPS Foam Cup' },
    { code: 'FS-02', name: 'Embalagem Food Service P', category: 'Food Service', shape: 'Rectangular Hinged PET Container' },
    { code: 'FS-03', name: 'Embalagem Food Service M', category: 'Food Service', shape: 'Rectangular Hinged PET Container' },
    { code: 'FS-04', name: 'Embalagem Food Service M Plus', category: 'Food Service', shape: 'Rectangular Hinged PET Container' },
    { code: 'FS-05', name: 'Embalagem Food Service Standard', category: 'Food Service', shape: 'Rectangular Hinged PET Container' },
    { code: 'FS-06', name: 'Embalagem Food Service Large', category: 'Food Service', shape: 'Rectangular Hinged PET Container' },
    { code: 'FS-07', name: 'Embalagem Food Service Grande', category: 'Food Service', shape: 'Rectangular Hinged PET Container' },
    { code: 'FS-08', name: 'Pote Térmico EPS', category: 'Food Service', shape: 'Thermal EPS Foam Bowl' }
];

const generatePrompt = (product) => {
    let content = "empty clean transparent container";
    let labelColor = "white"; // Default clean

    // Theme rules
    if (product.category === 'Confeitaria') {
        content = "filled with delicious colorful confectionery sweets or cake textures";
        if (product.name.includes('Pote')) content = "filled with colorful candy or layers of dessert";
    } else if (product.category === 'Açougue & Frios') {
        content = "filled with fresh deli meats or premium cuts of meat";
    } else if (product.category === 'Festa') {
        content = "filled with party snacks or fancy mini desserts";
    } else if (product.category === 'Food Service') {
        if (product.shape.includes('EPS')) {
            content = "clean white styrofoam thermal container, empty or with hot food suggestion";
        } else {
            content = "filled with fresh salad or delivery meal";
        }
    }

    return {
        filename: `${product.code}.png`,
        prompt: `Generate a high-end studio product photo of a ${product.shape}. Clean white background, soft studio lighting. The container is ${content}.
    
PRODUCT: ${product.name}
VARIATION: ${product.category}
CODE: ${product.code}

Rules:
- High quality commercial photography style
- ${product.shape.includes('EPS') ? 'White opaque foam texture' : 'Crystal clear transparent plastic texture'}
- Simple clean ${labelColor} label on the front
- Label text: NO LOGO. Print '${product.name}' and '${product.code}' clearly.
- No shadows, no reflections, no background objects.
- Consistent angle: Slightly high angle 3/4 view.`
    };
};

const prompts = products.map(generatePrompt);
console.log(JSON.stringify(prompts, null, 2));
