export interface ContractAddresses {
    finCube: string;
    finCubeDAO: string;
    fincubeERC20: string; // renamed properly
    mockERC20: string;
}

export const contractAddresses = {
    finCube: import.meta.env.VITE_FINCUBE_CONTRACT,
    finCubeDAO: import.meta.env.VITE_FINCUBE_DAO_CONTRACT,
    mockERC20: import.meta.env.VITE_MOCK_ERC20_CONTRACT,
};

